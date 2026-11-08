// flair-metal-hash: 15ee3d1e
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uAmount;
    float uRotation;
    float uDamping;
    float uFrequency;
    packed_float3 uColor;
    float uFlash;
    float uVignette;
    uint uDemo;
    char _m21_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_screen_shake_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 hitAt(thread const int& i, thread const bool& demo, thread const float& every, constant FlairUniforms& _184)
{
    bool _172 = !demo;
    bool _193;
    if (!_172)
    {
        _193 = _184.iClicks[0].w > 0.5;
    }
    else
    {
        _193 = _172;
    }
    if (_193)
    {
        return _184.iClicks[i];
    }
    float k = floor(_184.iTime / every) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.300000011920928955078125) + (h * 0.4000000059604644775390625)) * float2(_184.iResolution[0], _184.iResolution[1]), k * every, 1.0);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _184)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_184.uBackdrop) * _184.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_184.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _184)
{
    float4 _380;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _380 = overBackdrop(param, _184);
    }
    else
    {
        float2 param_1 = fract(uv);
        _380 = float4(testCard(param_1), 1.0);
    }
    return _380;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _184, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_184.iResolution[0], _184.iResolution[1]);
    float aspect = _184.iResolution[0u] / _184.iResolution[1u];
    float2 shake = float2(0.0);
    float twist = 0.0;
    float flash = 0.0;
    float pulse = 0.0;
    for (int i = 0; i < 4; i++)
    {
        int param = i;
        bool param_1 = _184.uDemo != 0u;
        float param_2 = 1.7999999523162841796875;
        float4 c = hitAt(param, param_1, param_2, _184);
        if (c.w < 0.5)
        {
            continue;
        }
        float age = _184.iTime - c.z;
        if ((age < 0.0) || (age > 3.0))
        {
            continue;
        }
        float env = exp((-age) * _184.uDamping) * smoothstep(0.0, 0.014999999664723873138427734375, age);
        float2 away = fast::normalize((float2(0.5) - (c.xy / float2(_184.iResolution[0], _184.iResolution[1]))) + float2(0.001000000047497451305389404296875)) * exp((-age) * 30.0);
        float s = age * _184.uFrequency;
        float2 param_3 = float2(s, c.z * 3.0);
        float2 param_4 = float2(s + 17.0, c.z * 5.0);
        float2 jitter = (float2(vnoise(param_3), vnoise(param_4)) * 2.0) - float2(1.0);
        shake += ((jitter + (away * 0.60000002384185791015625)) * env);
        float2 param_5 = float2((s * 0.800000011920928955078125) + 41.0, c.z);
        twist += (((vnoise(param_5) * 2.0) - 1.0) * env);
        flash += exp((-age) * 14.0);
        pulse += (exp((-age) * 4.0) * smoothstep(0.0, 0.02999999932944774627685546875, age));
    }
    float2 q = (uv - float2(0.5)) * float2(aspect, 1.0);
    float ang = (twist * _184.uRotation) * 0.0599999986588954925537109375;
    q = float2x2(float2(cos(ang), sin(ang)), float2(-sin(ang), cos(ang))) * q;
    q = (q / float2(1.0 + ((0.039999999105930328369140625 * _184.uAmount) * fast::min(length(shake), 1.0)))) + ((shake * _184.uAmount) * 0.02999999932944774627685546875);
    float2 st = (q / float2(aspect, 1.0)) + float2(0.5);
    float2 param_6 = st;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_6, _184);
    float3 col = pic.xyz;
    float2 e = (uv - float2(0.5)) * float2(aspect, 1.0);
    float vig = smoothstep(0.25, 0.949999988079071044921875, (length(e) / fast::max(aspect, 1.0)) * 1.39999997615814208984375);
    float v = (fast::clamp(pulse, 0.0, 1.0) * _184.uVignette) * vig;
    col = mix(col, (col * 0.300000011920928955078125) + (float3(_184.uColor) * 0.699999988079071044921875), float3(v));
    col = mix(col, mix(float3(_184.uColor), float3(1.0), float3(0.60000002384185791015625)), float3(fast::clamp(flash, 0.0, 1.0) * _184.uFlash));
    fragColor = float4(col, fast::max(pic.w, v));
}

fragment flair_screen_shake_frag_out flair_screen_shake_frag(constant FlairUniforms& _184 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_screen_shake_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _697;
    if (_184.flair_flipY > 0.5)
    {
        _697 = _184.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _697 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _697);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _184, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

