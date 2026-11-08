// flair-metal-hash: 57379280
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
    packed_float3 uMistColor;
    float uDensity;
    float uHorizon;
    float uGround;
    float uScatter;
    float uSpeed;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_mist_over_image_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _71)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_71.uBackdrop) * _71.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_71.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _71)
{
    float4 _215;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _215 = overBackdrop(param, _71);
    }
    else
    {
        float2 param_1 = fract(uv);
        _215 = float4(testCard(param_1), 1.0);
    }
    return _215;
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
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _71)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _71).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _71, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_71.iResolution[0], _71.iResolution[1]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _71);
    float aspect = _71.iResolution[0u] / _71.iResolution[1u];
    float t = _71.iTime * _71.uSpeed;
    float far = exp(-powr((uv.y - _71.uHorizon) / 0.180000007152557373046875, 2.0));
    float ground = (1.0 - smoothstep(0.0, 0.449999988079071044921875, uv.y)) * _71.uGround;
    float2 q = float2(uv.x * aspect, uv.y);
    float2 param_1 = float2((q.x * 2.0) - (t * 0.039999999105930328369140625), q.y * 6.0) + float2(3.0);
    int param_2 = 5;
    float _443 = fbm(param_1, param_2);
    float n1 = _443;
    float2 param_3 = float2((q.x * 3.5) + (t * 0.02500000037252902984619140625), (q.y * 9.0) - (t * 0.00999999977648258209228515625)) + float2(11.0);
    int param_4 = 4;
    float _467 = fbm(param_3, param_4);
    float n2 = _467;
    float drift = smoothstep(0.25, 0.800000011920928955078125, (0.60000002384185791015625 * n1) + (0.4000000059604644775390625 * n2));
    float mist = fast::clamp((((far * 0.699999988079071044921875) + ground) * mix(0.449999988079071044921875, 1.25, drift)) + 0.119999997317790985107421875, 0.0, 1.0) * _71.uDensity;
    float3 glow = float3(0.0);
    for (int i = 0; i < 8; i++)
    {
        float a = (float(i) * 0.785398006439208984375) + 0.4000000059604644775390625;
        float2 o = float2(cos(a), sin(a) * aspect) * 0.0350000001490116119384765625;
        float2 param_5 = uv + o;
        float3 s = picture(uImage, uImageSmplr, param_5, _71);
        float2 param_6 = uv + (o * 2.400000095367431640625);
        float3 s2 = picture(uImage, uImageSmplr, param_6, _71);
        glow += (fast::max(s - float3(0.550000011920928955078125), float3(0.0)) + (fast::max(s2 - float3(0.550000011920928955078125), float3(0.0)) * 0.60000002384185791015625));
    }
    glow /= float3(8.0);
    float3 haze = float3(_71.uMistColor) + ((glow * _71.uScatter) * 1.60000002384185791015625);
    float3 col = mix(pic.xyz, haze, float3(mist));
    col += (((glow * _71.uScatter) * 0.5) * (1.0 - mist));
    fragColor = float4(col, pic.w);
}

fragment flair_mist_over_image_frag_out flair_mist_over_image_frag(constant FlairUniforms& _71 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_mist_over_image_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _598;
    if (_71.flair_flipY > 0.5)
    {
        _598 = _71.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _598 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _598);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _71, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

