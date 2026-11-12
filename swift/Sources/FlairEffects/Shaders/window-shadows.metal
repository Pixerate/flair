// flair-metal-hash: c30ff1fa
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
}

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
    uint uPlainWall;
    char _m14_pad[12];
    packed_float3 uWall;
    int uPattern;
    packed_float3 uLight;
    float uIntensity;
    float uShade;
    float uAngle;
    float uScale;
    float uSoftness;
    float uSway;
    char _m23_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_window_shadows_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float windowPatch(thread const float2& q, thread const float& soft)
{
    float2 e = abs(q) - float2(0.5, 0.4000000059604644775390625);
    return smoothstep(soft, -soft, fast::max(e.x, e.y));
}

static inline __attribute__((always_inline))
float blinds(thread float2& q, thread const float& t, thread const float& soft, constant FlairUniforms& _87)
{
    q.x += ((0.006000000052154064178466796875 * sin(t * 0.699999988079071044921875)) * _87.uSway);
    float open = fast::clamp(0.5 + (0.2199999988079071044921875 * sin(((t * 0.3499999940395355224609375) * _87.uSway) + 0.4000000059604644775390625)), 0.1500000059604644775390625, 0.85000002384185791015625);
    float f = fract((q.y * 14.0) + ((0.039999999105930328369140625 * sin((q.x * 3.0) + (t * 0.5))) * _87.uSway));
    float w = 0.02999999932944774627685546875 + (soft * 0.25);
    float lit = smoothstep(0.0, w, f) * smoothstep(open + w, open, f);
    float bars = smoothstep(0.01200000010430812835693359375 + (soft * 0.02999999932944774627685546875), 0.006000000052154064178466796875, abs(q.x)) + smoothstep(0.01200000010430812835693359375 + (soft * 0.02999999932944774627685546875), 0.006000000052154064178466796875, abs(q.y - 0.0199999995529651641845703125));
    float2 param = q;
    float param_1 = 0.0199999995529651641845703125 + (soft * 0.0599999986588954925537109375);
    return (lit * (1.0 - fast::clamp(bars, 0.0, 1.0))) * windowPatch(param, param_1);
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
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float leaves(thread const float2& q, thread const float& t, thread const float& soft, constant FlairUniforms& _87)
{
    float2 param = (q * 6.0) + float2(t * 1.2999999523162841796875);
    float2 param_1 = ((q * 6.0) - float2(t * 1.10000002384185791015625)) + float2(7.0);
    float2 sway = (float2(0.0500000007450580596923828125 * sin((t * 0.60000002384185791015625) + (q.y * 1.5)), 0.02999999932944774627685546875 * cos((t * 0.449999988079071044921875) + (q.x * 1.2000000476837158203125))) + (float2(vnoise(param), vnoise(param_1)) * 0.01200000010430812835693359375)) * _87.uSway;
    float2 param_2 = ((q + sway) * 3.2000000476837158203125) + float2(4.0);
    int param_3 = 5;
    float _572 = fbm(param_2, param_3);
    float n = _572;
    float s = 0.02500000037252902984619140625 + (soft * 0.100000001490116119384765625);
    float lit = smoothstep(0.5 - s, 0.5 + s, n);
    float2 param_4 = q * 0.75;
    float param_5 = 0.07999999821186065673828125 + (soft * 0.100000001490116119384765625);
    return lit * windowPatch(param_4, param_5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _87)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_87.uBackdrop) * _87.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_87.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _87)
{
    float4 _231;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _231 = overBackdrop(param, _87);
    }
    else
    {
        float2 param_1 = fract(uv);
        _231 = float4(testCard(param_1), 1.0);
    }
    return _231;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _87, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_87.iResolution[0], _87.iResolution[1]);
    float2 p = (fragCoord - (float2(_87.iResolution[0], _87.iResolution[1]) * 0.5)) / float2(_87.iResolution[1u]);
    float param = radians(_87.uAngle);
    float2 q = (rot(param) * p) / float2(_87.uScale);
    q.x += (q.y * 0.3499999940395355224609375);
    float _643;
    if (_87.uPattern == 0)
    {
        float2 param_1 = q;
        float param_2 = _87.iTime;
        float param_3 = _87.uSoftness;
        float _655 = blinds(param_1, param_2, param_3, _87);
        _643 = _655;
    }
    else
    {
        float2 param_4 = q;
        float param_5 = _87.iTime;
        float param_6 = _87.uSoftness;
        _643 = leaves(param_4, param_5, param_6, _87);
    }
    float lit = _643;
    float4 base;
    if (_87.uPlainWall != 0u)
    {
        float2 param_7 = fragCoord * 0.3499999940395355224609375;
        float2 param_8 = fragCoord * 0.0500000007450580596923828125;
        float plaster = (vnoise(param_7) * 0.5) + (vnoise(param_8) * 0.5);
        base = float4(float3(_87.uWall) * (0.959999978542327880859375 + (0.0599999986588954925537109375 * plaster)), 1.0);
    }
    else
    {
        float2 param_9 = uv;
        base = pictureRGBA(uImage, uImageSmplr, param_9, _87);
    }
    float3 light = (float3(0.949999988079071044921875, 0.959999978542327880859375, 1.0) * (1.0 - _87.uShade)) + ((float3(_87.uLight) * (lit * _87.uShade)) * (0.60000002384185791015625 + _87.uIntensity));
    float3 col = base.xyz * light;
    col /= (float3(1.0) + fast::max(col - float3(1.0), float3(0.0)));
    fragColor = float4(col, base.w);
}

fragment flair_window_shadows_frag_out flair_window_shadows_frag(constant FlairUniforms& _87 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_window_shadows_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _758;
    if (_87.flair_flipY > 0.5)
    {
        _758 = _87.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _758 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _758);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _87, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

