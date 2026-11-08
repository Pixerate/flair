// flair-metal-hash: 4c0d56bb
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
    packed_float3 uBacking;
    float uGrime;
    float uAngle;
    float uReach;
    float uCycle;
    uint uAnimate;
    float uProgress;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_peeling_wallpaper_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _204)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_204.uBackdrop) * _204.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_204.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _204)
{
    float4 _341;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _341 = overBackdrop(param, _204);
    }
    else
    {
        float2 param_1 = fract(uv);
        _341 = float4(testCard(param_1), 1.0);
    }
    return _341;
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _204, texture2d<float> uImage, sampler uImageSmplr, texture2d<float> uUnder, sampler uUnderSmplr)
{
    float2 uv = fragCoord / float2(_204.iResolution[0], _204.iResolution[1]);
    float aspect = _204.iResolution[0u] / _204.iResolution[1u];
    float2 q = (fragCoord - (float2(_204.iResolution[0], _204.iResolution[1]) * 0.5)) / float2(_204.iResolution[1u]);
    float2 half_ = float2(0.5 * aspect, 0.5);
    float2 dir = float2(cos(radians(_204.uAngle)), sin(radians(_204.uAngle)));
    float2 across = float2(-dir.y, dir.x);
    float span = (abs(dir.x) * half_.x) + (abs(dir.y) * half_.y);
    float _426;
    if (_204.uAnimate != 0u)
    {
        _426 = smoothstep(0.0500000007450580596923828125, 0.550000011920928955078125, fract(_204.iTime / _204.uCycle)) * (1.0 - smoothstep(0.75, 1.0, fract(_204.iTime / _204.uCycle)));
    }
    else
    {
        _426 = _204.uProgress;
    }
    float k = _426;
    float2 param = float2(dot(q, across) * 18.0, 3.0);
    float fold = ((-span) + (((k * _204.uReach) * 2.0) * span)) + ((vnoise(param) - 0.5) * 0.02500000037252902984619140625);
    float t = dot(q, dir);
    float2 param_1 = uv;
    float4 paper = pictureRGBA(uImage, uImageSmplr, param_1, _204);
    float2 param_2 = uv;
    float4 under = pictureRGBA(uUnder, uUnderSmplr, param_2, _204);
    float2 param_3 = q * 5.0;
    int param_4 = 4;
    float _499 = fbm(param_3, param_4);
    float stain = _499;
    float3 grimy = (under.xyz * mix(1.0, 0.550000011920928955078125 + (0.4000000059604644775390625 * stain), _204.uGrime)) * mix(float3(1.0), float3(0.89999997615814208984375, 0.85000002384185791015625, 0.64999997615814208984375), float3(_204.uGrime * smoothstep(0.449999988079071044921875, 0.699999988079071044921875, stain)));
    float2 param_5 = float2(dot(q, across) * 40.0, t * 3.0);
    grimy *= (1.0 - ((0.1500000059604644775390625 * _204.uGrime) * smoothstep(0.699999988079071044921875, 0.89999997615814208984375, vnoise(param_5))));
    float3 col;
    float alpha;
    if (t < fold)
    {
        col = grimy * (1.0 - (0.550000011920928955078125 * exp((-(fold - t)) / 0.039999999105930328369140625)));
        alpha = under.w;
    }
    else
    {
        col = paper.xyz;
        alpha = paper.w;
        float2 m = q - (dir * (2.0 * (t - fold)));
        bool _580 = abs(m.x) < half_.x;
        bool _589;
        if (_580)
        {
            _589 = abs(m.y) < half_.y;
        }
        else
        {
            _589 = _580;
        }
        bool _599;
        if (_589)
        {
            _599 = (t - fold) < (fold + span);
        }
        else
        {
            _599 = _589;
        }
        if (_599)
        {
            float from = t - fold;
            float shade = (0.7200000286102294921875 + (0.2800000011920928955078125 * smoothstep(0.0, 0.119999997317790985107421875, from))) - (0.119999997317790985107421875 * smoothstep(0.100000001490116119384765625, 0.4000000059604644775390625, from));
            float2 param_6 = m * 90.0;
            col = (float3(_204.uBacking) * shade) * (0.920000016689300537109375 + (0.07999999821186065673828125 * vnoise(param_6)));
            alpha = 1.0;
        }
        else
        {
            float2 mm = q - (dir * (2.0 * ((t - fold) - 0.014999999664723873138427734375)));
            float near = (step(abs(mm.x), half_.x) * step(abs(mm.y), half_.y)) * step(0.0, fold + span);
            col *= (1.0 - ((0.25 * near) * step(0.001000000047497451305389404296875, k)));
        }
    }
    fragColor = float4(col, alpha);
}

fragment flair_peeling_wallpaper_frag_out flair_peeling_wallpaper_frag(constant FlairUniforms& _204 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uUnder [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uUnderSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_peeling_wallpaper_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _688;
    if (_204.flair_flipY > 0.5)
    {
        _688 = _204.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _688 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _688);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _204, uImage, uImageSmplr, uUnder, uUnderSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

